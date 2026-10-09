import { requestStatusLabel } from "@/lib/types";
export const statusLabel:Record<string,string>=Object.fromEntries(Object.entries(requestStatusLabel).map(([key,value])=>[key,value.zh]));
