import {ThreadPool} from "peak-threads";
import {createContext} from "react";

export const PoolContext = createContext((null as any) as ThreadPool);
