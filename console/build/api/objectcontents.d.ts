import { AdtHTTP } from "../AdtHTTP";
import { ObjectVersion } from "./objectstructure";
export interface AdtLock {
    LOCK_HANDLE: string;
    CORRNR: string;
    CORRUSER: string;
    CORRTEXT: string;
    IS_LOCAL: string;
    IS_LINK_UP: string;
    MODIFICATION_SUPPORT: string;
}
export interface ObjectSourceOptions {
    version?: ObjectVersion;
    gitUser?: string;
    gitPassword?: string;
}
export declare function getObjectSource(h: AdtHTTP, objectSourceUrl: string, options?: ObjectSourceOptions): Promise<string>;
export declare function setObjectSource(h: AdtHTTP, objectSourceUrl: string, source: string, lockHandle: string, transport?: string): Promise<void>;
export declare function lock(h: AdtHTTP, objectUrl: string, accessMode?: string): Promise<AdtLock>;
export declare function unLock(h: AdtHTTP, objectUrl: string, lockHandle: string): Promise<string>;
//# sourceMappingURL=objectcontents.d.ts.map