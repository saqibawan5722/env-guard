import os

def start_worker():
    queue_name = os.environ.get('QUEUE_NAME', 'default')
    concurrency = int(os.getenv('WORKER_CONCURRENCY', '4'))
    api_key = os.environ['EXTERNAL_PAYMENT_API_KEY']
    print(f"Worker listening on {queue_name} with concurrency {concurrency}")

if __name__ == '__main__':
    start_worker()
