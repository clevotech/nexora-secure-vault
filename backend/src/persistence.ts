import type {Pool} from "pg";
import {MemoryStoreMemory,MemoryStorePostgres} from "./storage.js";
import {CreditStoreMemory,CreditStorePostgres} from "./credits.js";
import {JobStoreMemory,JobStorePostgres} from "./jobs.js";

export function createPersistence(pool:Pool|null){
  return {
    memory:pool?new MemoryStorePostgres(pool):new MemoryStoreMemory(),
    credits:pool?new CreditStorePostgres(pool):new CreditStoreMemory(),
    jobs:pool?new JobStorePostgres(pool):new JobStoreMemory()
  };
}
