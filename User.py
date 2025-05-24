class User:
    usersCount = 0

    def __init__(self):
        self.id = User.usersCount
        User.usersCount += 1