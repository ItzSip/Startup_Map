KEYWORDS={"artificial intelligence":"AI / Machine Learning","machine learning":"AI / Machine Learning","fintech":"FinTech","education":"EdTech","health":"HealthTech","robot":"Robotics","climate":"ClimateTech","logistics":"Logistics","developer":"Developer Tools","saas":"SaaS","e-commerce":"E-commerce"}
def extract(text: str) -> str:
    lower=text.casefold()
    return next((industry for keyword,industry in KEYWORDS.items() if keyword in lower),"Other")
