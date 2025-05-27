import requests
import time
import statistics

def test_ping():
    """Test the ping endpoint response time."""
    print("Testing ping endpoint...")
    times = []
    for _ in range(10):
        start = time.time()
        response = requests.get("http://localhost:80/ping")
        end = time.time()
        if response.status_code == 200:
            times.append((end - start) * 1000)  # Convert to ms
        time.sleep(0.2)
    
    if times:
        print(f"Ping response times (ms): {times}")
        print(f"Average: {statistics.mean(times):.2f} ms")
        print(f"Median: {statistics.median(times):.2f} ms")
    else:
        print("All ping requests failed")

def test_download():
    """Test the download endpoint."""
    print("Testing download endpoint...")
    response = requests.get("http://localhost:80/download", stream=True)
    start = time.time()
    total_bytes = 0
    
    # Read for 2 seconds
    end_time = start + 2
    for chunk in response.iter_content(chunk_size=8192):
        if time.time() > end_time:
            break
        total_bytes += len(chunk)
    
    duration = time.time() - start
    mbps = (total_bytes * 8) / (1000000 * duration)
    print(f"Download speed: {mbps:.2f} Mbps")

def test_upload():
    """Test the upload endpoint."""
    print("Testing upload endpoint...")
    # Create 1MB of random data
    data = b'0' * 1000000
    
    start = time.time()
    total_bytes = 0
    
    # Upload for 2 seconds
    end_time = start + 2
    while time.time() < end_time:
        response = requests.post("http://localhost:80/upload", data=data)
        if response.status_code == 200:
            total_bytes += len(data)
    
    duration = time.time() - start
    mbps = (total_bytes * 8) / (1000000 * duration)
    print(f"Upload speed: {mbps:.2f} Mbps")

if __name__ == "__main__":
    test_ping()
    test_download()
    test_upload()