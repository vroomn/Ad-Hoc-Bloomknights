import os

from flask import Flask, send_from_directory, url_for, redirect, request, make_response

def create_app(test_config=None):
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_mapping(
        SECRET_KEY='dev',
        DATABASE=os.path.join(app.instance_path, 'flaskr.sqlite')
    )

    # Make sure a test config is not loaded
    if test_config is None:
        app.config.from_pyfile('config.py', silent=True)
    else:
        exit(4)

    # Instance path is guaranteed by the docker image being built (a volume)
    #os.makedirs(app.instance_path, exist_ok=True)

    # -------------------------
    # Servicing Static Content
    # -------------------------

    @app.route('/style.css')
    def style():
        return redirect(url_for('static', filename='style.css'))
    
    @app.route('/script.js')
    def script():
        return redirect(url_for('static', filename='script.js'))

    @app.route('/')
    def index():
        return send_from_directory('static', 'index.html')
    
    # Process inputted CSVs into usable data
    @app.route('/upload', methods=['POST'])
    def upload_file():
        if 'file'not in request.files:
            return {"error": "No file was submitted with the request"}, 400
        file = request.files['file']
        if file.filename == '':
            return {"error": "An invalid file name was submitted"}, 400
        
        # TODO: Implement proper file sorting and such
        if file:
            filename = file.filename
        else:
            return {"error": "No file was submitted with the request"}, 400
        
        file.save(filename or "noname.txt")

        return {"success": f"{filename} successfully processed by server"}
    
    # -------------------------
    
    # Return the configured Flask system
    return app