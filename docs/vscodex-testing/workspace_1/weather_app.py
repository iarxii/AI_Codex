import requests

def get_weather(city):
    api_key = "your_api_key_here"  # User needs to provide their own OpenWeatherMap API key
    base_url = "http://api.openweathermap.org/data/2.5/weather"
    params = {
        "q": city,
        "appid": api_key,
        "units": "metric"
    }
    
    try:
        response = requests.get(base_url, params=params)
        response.raise_for_status()
        data = response.json()
        
        temp = data['main']['temp']
        desc = data['weather'][0]['description']
        return f"The current weather in {city} is {temp}°C with {desc}."
    except requests.exceptions.HTTPError:
        return "City not found or API key invalid."
    except Exception as e:
        return f"An error occurred: {e}"

if __name__ == "__main__":
    city_name = input("Enter city name: ")
    print(get_weather(city_name))