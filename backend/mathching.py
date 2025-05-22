from queue import Queue

waiting_queue = Queue()

def try_match(user_id):
    if(not waiting_queue.empty()):
        enemy = waiting_queue.get()
        return (user_id,enemy)
    else:
        waiting_queue.put(user_id)
        return None