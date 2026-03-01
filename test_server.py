import urllib.request
import json

def test():
    try:
        req = urllib.request.Request("http://localhost:8000/docs", method="GET")
        with urllib.request.urlopen(req) as response:
            print("Server is responsive to HTTP GET.")
    except Exception as e:
        print(f"Server is NOT responsive to HTTP: {e}")

if __name__ == "__main__":
    test()
