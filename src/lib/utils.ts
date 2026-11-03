import {clsx,type ClassValue} from "clsx"; import {twMerge} from "tailwind-merge";
export function cn(...inputs:ClassValue[]){return twMerge(clsx(inputs))}
export function safeUrl(value:string|null|undefined){if(!value)return null;try{const url=new URL(value);return ["http:","https:"].includes(url.protocol)?url.toString():null}catch{return null}}
export function formatDate(value:string){return new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kolkata"}).format(new Date(value))}
