# incorperated Google AI and outside .py file for assisting with database management and CSV import
import csv
import multiprocessing
import psycopg2
import pandas as pd

connection = psycopg2.connect(
    host="localhost",
    database="your_database",
    user="your_username",
    password="your_password"
)
cursor = connection.cursor()


#used google AI to help with this function
# Assign the user's uploaded CSV to a DataFrame variable
file_path = "user_uploaded_data.csv"
dataset_variable = pd.read_csv(file_path)

# You can now manipulate the variable
print(dataset_variable.head())


with open(file_path, 'r') as f:
    csv_reader = csv.reader(f)
    next(csv_reader)  # Skip header row
    for row in csv_reader:
        item_name, quantity = row
        # Process each row (e.g., insert into database)


    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Financial (
            id SERIAL PRIMARY KEY,
            item_name VARCHAR(255) NOT NULL,
            quantity INTEGER NOT NULL
        );
    """)



    # Example Operation: Insert a record
    cursor.execute(
        "INSERT INTO Financial (item_name, quantity) VALUES (%s, %s);", #table is called Financial and has columns item_name and quantity
        ("Dockerized Server", 5)
    )
    
    # Example Operation: Query data
    cursor.execute("SELECT * FROM Financial;")
    print("Database Records:", cursor.fetchall())

    
    connection.commit()
    cursor.close()
    connection.close()

if __name__ == "__main__":
    manage_database()