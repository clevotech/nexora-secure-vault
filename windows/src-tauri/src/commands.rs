use aes_gcm::{aead::{Aead, KeyInit}, Aes256Gcm, Nonce};
use argon2::{Argon2, Algorithm, Params, Version};
use rand::Rng;
use std::fs::File;
use std::io::{Read, Write};

const CHUNK: usize = 1024 * 1024;
const NONCE: usize = 12;

fn kdf(password: &str, salt: &[u8]) -> Result<[u8;32], String> {
    let params = Params::new(65536, 3, 1, Some(32)).map_err(|e| e.to_string())?;
    let mut key=[0u8;32];
    Argon2::new(Algorithm::Argon2id, Version::V0x13, params)
        .hash_password_into(password.as_bytes(), salt, &mut key).map_err(|e| e.to_string())?;
    Ok(key)
}
fn u32le(v:u32)->[u8;4]{v.to_le_bytes()}
fn read_header(src:&mut File)->Result<(Vec<u8>,serde_json::Value),String>{
    let mut b=[0u8;4];src.read_exact(&mut b).map_err(|e|e.to_string())?;
    let hl=u32::from_le_bytes(b) as usize;if hl==0||hl>65536{return Err("Invalid header".into())}
    let mut hb=vec![0u8;hl];src.read_exact(&mut hb).map_err(|e|e.to_string())?;
    let h:serde_json::Value=serde_json::from_slice(&hb).map_err(|_|"Invalid header".to_string())?;
    if h["magic"]!="NSV1"||(h["version"]!=1&&h["version"]!=2)||h["algorithm"]!="AES-256-GCM"||h["kdf"]!="Argon2id"{return Err("Unsupported container".into())}
    Ok((hb,h))
}
fn salt_from_header(h:&serde_json::Value)->Result<Vec<u8>,String>{
    let salt=hex::decode(h["salt"].as_str().ok_or("Invalid salt")?).map_err(|_|"Invalid salt".to_string())?;
    if salt.len()!=16{return Err("Invalid salt".into())}Ok(salt)
}
fn private_metadata(h:&serde_json::Value,key:&[u8;32])->Result<serde_json::Value,String>{
    let nonce=hex::decode(h["nameNonce"].as_str().ok_or("Missing metadata nonce")?).map_err(|_|"Invalid metadata nonce".to_string())?;
    let ciphertext=hex::decode(h["nameCiphertext"].as_str().ok_or("Missing encrypted metadata")?).map_err(|_|"Invalid encrypted metadata".to_string())?;
    if nonce.len()!=NONCE{return Err("Invalid metadata nonce".into())}
    let cipher=Aes256Gcm::new_from_slice(key).map_err(|e|e.to_string())?;
    let raw=cipher.decrypt(Nonce::from_slice(&nonce),ciphertext.as_ref()).map_err(|_|"Incorrect password or damaged encrypted metadata".to_string())?;
    serde_json::from_slice(&raw).map_err(|_|"Invalid encrypted metadata".to_string())
}
fn header_json(salt:&[u8],key:&[u8;32],name:&str,size:u64,created:&str,id:&str)->Result<Vec<u8>,String>{
    let cipher=Aes256Gcm::new_from_slice(key).map_err(|e|e.to_string())?;
    let mut name_nonce=[0u8;NONCE];rand::rng().fill_bytes(&mut name_nonce);
    let safe_name=name.replace(['\\','/'],"_");
    let metadata=serde_json::to_vec(&serde_json::json!({"originalName":safe_name})).map_err(|_|"Metadata serialization failed".to_string())?;
    let name_ciphertext=cipher.encrypt(Nonce::from_slice(&name_nonce),metadata.as_slice()).map_err(|_|"Metadata encryption failed".to_string())?;
    Ok(serde_json::to_vec(&serde_json::json!({"magic":"NSV1","version":2,"algorithm":"AES-256-GCM","kdf":"Argon2id","salt":hex::encode(salt),"chunkSize":CHUNK,"originalName":"Encrypted file","nameNonce":hex::encode(name_nonce),"nameCiphertext":hex::encode(name_ciphertext),"originalSize":size.to_string(),"createdAt":created,"operationId":id})).unwrap())
}
#[tauri::command]
pub fn encrypt_nsv1(input:String,output:String,password:String,file_name:String,created_at:String,operation_id:String)->Result<u64,String>{
    if password.is_empty(){return Err("Password is required".into())}
    let mut src=File::open(&input).map_err(|e|e.to_string())?;
    let size=src.metadata().map_err(|e|e.to_string())?.len();
    let mut salt=[0u8;16];rand::rng().fill_bytes(&mut salt);let key=kdf(&password,&salt)?;
    let hb=header_json(&salt,&key,&file_name,size,&created_at,&operation_id)?;
    if hb.len()>65536{return Err("Header too large".into())}
    let mut dst=File::create(&output).map_err(|e|e.to_string())?;
    dst.write_all(&u32le(hb.len() as u32)).and_then(|_|dst.write_all(&hb)).map_err(|e|e.to_string())?;
    let cipher=Aes256Gcm::new_from_slice(&key).map_err(|e|e.to_string())?;
    let mut buf=vec![0u8;CHUNK];let mut seq=0u32;let mut total=0u64;
    loop{
        let n=src.read(&mut buf).map_err(|e|e.to_string())?;
        if n==0{
            if seq==0{
                let mut nonce=[0u8;NONCE];rand::rng().fill_bytes(&mut nonce);
                let aad=[hb.as_slice(),&0u32.to_le_bytes()].concat();
                let ct=cipher.encrypt(Nonce::from_slice(&nonce),aes_gcm::aead::Payload{msg:&[],aad:&aad}).map_err(|_|"Encryption failed".to_string())?;
                dst.write_all(&u32le(0)).and_then(|_|dst.write_all(&[NONCE as u8])).and_then(|_|dst.write_all(&nonce)).and_then(|_|dst.write_all(&u32le(ct.len() as u32))).and_then(|_|dst.write_all(&ct)).map_err(|e|e.to_string())?;
            }
            break
        }
        let mut nonce=[0u8;NONCE];rand::rng().fill_bytes(&mut nonce);
        let aad=[hb.as_slice(),&seq.to_le_bytes()].concat();
        let ct=cipher.encrypt(Nonce::from_slice(&nonce),aes_gcm::aead::Payload{msg:&buf[..n],aad:&aad}).map_err(|_|"Encryption failed".to_string())?;
        dst.write_all(&u32le(seq)).and_then(|_|dst.write_all(&[NONCE as u8])).and_then(|_|dst.write_all(&nonce)).and_then(|_|dst.write_all(&u32le(ct.len() as u32))).and_then(|_|dst.write_all(&ct)).map_err(|e|e.to_string())?;
        seq+=1;total+=n as u64;
    }
    dst.flush().map_err(|e|e.to_string())?;Ok(total)
}
#[tauri::command]
pub fn inspect_nsv1_name(input:String,password:String)->Result<String,String>{
    let mut src=File::open(&input).map_err(|e|e.to_string())?;
    let (_hb,h)=read_header(&mut src)?;let salt=salt_from_header(&h)?;let key=kdf(&password,&salt)?;
    if h["version"]==2{
        let metadata=private_metadata(&h,&key)?;
        return metadata["originalName"].as_str().map(|s|s.to_string()).ok_or_else(||"Invalid encrypted filename metadata".into());
    }
    h["originalName"].as_str().map(|s|s.to_string()).ok_or_else(||"Invalid filename metadata".into())
}
#[tauri::command]
pub fn decrypt_nsv1(input:String,output:String,password:String)->Result<u64,String>{
    let mut src=File::open(&input).map_err(|e|e.to_string())?;
    let (hb,h)=read_header(&mut src)?;let salt=salt_from_header(&h)?;let key=kdf(&password,&salt)?;
    let size=h["originalSize"].as_str().ok_or("Invalid size")?.parse::<u64>().map_err(|_|"Invalid size".to_string())?;
    let cipher=Aes256Gcm::new_from_slice(&key).map_err(|e|e.to_string())?;
    let mut dst=File::create(&output).map_err(|e|e.to_string())?;
    let mut b=[0u8;4];let mut expected=0u32;let mut total=0u64;
    loop{
        let n=src.read(&mut b).map_err(|e|e.to_string())?;if n==0{break}if n!=4{return Err("Malformed chunk".into())}
        let seq=u32::from_le_bytes(b);if seq!=expected{return Err("Invalid chunk sequence".into())}
        let mut nl=[0u8;1];src.read_exact(&mut nl).map_err(|e|e.to_string())?;if nl[0]!=12{return Err("Invalid nonce".into())}
        let mut nonce=[0u8;12];src.read_exact(&mut nonce).map_err(|e|e.to_string())?;src.read_exact(&mut b).map_err(|e|e.to_string())?;
        let clen=u32::from_le_bytes(b) as usize;if clen<16||clen>CHUNK+16{return Err("Invalid ciphertext length".into())}
        let mut ct=vec![0u8;clen];src.read_exact(&mut ct).map_err(|e|e.to_string())?;
        let aad=[hb.as_slice(),&seq.to_le_bytes()].concat();
        let pt=cipher.decrypt(Nonce::from_slice(&nonce),aes_gcm::aead::Payload{msg:&ct,aad:&aad}).map_err(|_|"Authentication failed".to_string())?;
        total+=pt.len() as u64;if total>size{return Err("Integrity/size verification failed".into())}
        dst.write_all(&pt).map_err(|e|e.to_string())?;expected+=1;
    }
    if total!=size{return Err("Integrity/size verification failed".into())}
    dst.flush().map_err(|e|e.to_string())?;Ok(total)
}
