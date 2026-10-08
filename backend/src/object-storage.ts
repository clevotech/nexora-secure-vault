import {S3Client,PutObjectCommand,GetObjectCommand} from "@aws-sdk/client-s3";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";

export type StoredObject={key:string;contentType:string;size:number};
export interface ObjectStorage{
  put(key:string,data:Uint8Array,contentType:string):Promise<StoredObject>;
  signedGet(key:string,expiresInSeconds?:number):Promise<string>;
}

export class S3ObjectStorage implements ObjectStorage{
  private readonly client:S3Client;
  constructor(
    private readonly bucket:string,region:string,endpoint?:string,
    accessKeyId?:string,secretAccessKey?:string
  ){
    this.client=new S3Client({
      region,
      ...(endpoint?{endpoint,forcePathStyle:process.env.NEXORA_STORAGE_PATH_STYLE==="true"}:{}),
      ...(accessKeyId&&secretAccessKey?{credentials:{accessKeyId,secretAccessKey}}:{})
    });
  }
  async put(key:string,data:Uint8Array,contentType:string){
    await this.client.send(new PutObjectCommand({Bucket:this.bucket,Key:key,Body:data,ContentType:contentType}));
    return {key,contentType,size:data.byteLength};
  }
  async signedGet(key:string,expiresInSeconds=300){
    return getSignedUrl(this.client,new GetObjectCommand({Bucket:this.bucket,Key:key}),{
      expiresIn:Math.min(Math.max(expiresInSeconds,30),900)
    });
  }
}

export function createObjectStorage(){
  const bucket=process.env.NEXORA_STORAGE_BUCKET;
  if(!bucket)return null;
  return new S3ObjectStorage(
    bucket,process.env.NEXORA_STORAGE_REGION||"us-east-1",
    process.env.NEXORA_STORAGE_ENDPOINT,process.env.NEXORA_STORAGE_ACCESS_KEY,
    process.env.NEXORA_STORAGE_SECRET_KEY
  );
}
