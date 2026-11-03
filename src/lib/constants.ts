export const INDUSTRIES=["AI / Machine Learning","SaaS","FinTech","EdTech","HealthTech","E-commerce","DeepTech","Robotics","Developer Tools","Logistics","ClimateTech","Other"] as const;
export const NEIGHBOURHOODS=["Koramangala","HSR Layout","Indiranagar","Whitefield","Electronic City","Bellandur","Marathahalli","Jayanagar","MG Road","Other"] as const;
export const BANGALORE_CENTER={latitude:12.9716,longitude:77.5946,zoom:11};
export const AD_PACKAGES={flash:{name:"Flash Promotion",amount:1000,durationHours:24},weekly:{name:"Weekly Spotlight",amount:3000,durationHours:168}} as const;
export type PackageType=keyof typeof AD_PACKAGES;
