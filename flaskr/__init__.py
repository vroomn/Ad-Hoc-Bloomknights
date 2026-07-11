import os

from flask import Flask, send_from_directory, url_for, redirect

def create_app(test_config=None):
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_mapping(
        SECRET_KEY='dev',
        DATABASE=os.path.join(app.instance_path, 'flaskr.sqlite')
    )

    if test_config is None:
        app.config.from_pyfile('config.py', silent=True)
    else:
        exit(4)

    # Instance path is guaranteed by the docker image being built (a volume)
    #os.makedirs(app.instance_path, exist_ok=True)

    @app.route('/style.css')
    def style():
        return redirect(url_for('static', filename='style.css'))
    
    @app.route('/script.js')
    def script():
        return redirect(url_for('static', filename='script.js'))

    @app.route('/')
    def index():
        return send_from_directory('static', 'index.html')

    @app.route('/hello')
    def hello():
        return 'Hello world'
    
    return app