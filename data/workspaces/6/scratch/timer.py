import time
import sys

def countdown_timer(seconds: int):
    """
    A professional countdown timer that updates in-place.
    """
    try:
        while seconds > 0:
            # Calculate minutes and seconds
            mins, secs = divmod(seconds, 60)
            
            # Format as MM:SS
            timer_display = f"{mins:02d}:{secs:02d}"
            
            # \r returns the cursor to the start of the line for an in-place update
            sys.stdout.write(f"\rTime Remaining: {timer_display} ")
            sys.stdout.flush()
            
            time.sleep(1)
            seconds -= 1
            
        print("\n\nTime's up! 🔔")
        
    except KeyboardInterrupt:
        print("\n\nTimer interrupted by user.")

if __name__ == "__main__":
    try:
        user_input = input("Enter timer duration in seconds: ")
        duration = int(user_input)
        if duration <= 0:
            print("Please enter a positive number.")
        else:
            countdown_timer(duration)
    except ValueError:
        print("Invalid input. Please enter a whole number.")
