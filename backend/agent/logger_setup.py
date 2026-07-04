from .loggingconfig import configurelogging

# Configure once, typically near the entry‑point of your app
logger = configurelogging(loglevel="DEBUG") 