import os

from flask import Flask, send_from_directory, url_for, redirect, request, make_response

from google import genai

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
    # FIXME: All of this is terrible, I am ashamed but it serves a page so thats something

    @app.route('/style.css')
    def style():
        return redirect(url_for('static', filename='style.css'))
    
    @app.route('/script.js')
    def script():
        return redirect(url_for('static', filename='script.js'))

    @app.route('/')
    def index():
        return send_from_directory('static', 'index.html')
    
    # -------------------------


    # -------------------------
    # Core API
    # -------------------------

    client = genai.Client()
    
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
    
    @app.route('/query', methods=['GET'])
    def query():
        msg = request.args.get('q')

        interaction = client.interactions.create(
            model="gemini-3.5-flash",
            input='''This is your identity: Hi, I'm Portfolio IQ Assistant. I can explain your portfolio or general finance concepts. 
            this is their financial data: {
    ticker: "AAPL",
    name: "Apple Inc",
    shares: 10,
    currentPrice: 189.5,
    totalValue: 1895,
    gainLoss: 443,
    gainLossPercent: 30.51,
    sector: "Technology"
  },
  {
    ticker: "TSLA",
    name: "Tesla Inc",
    shares: 5,
    currentPrice: 218.75,
    totalValue: 1093.75,
    gainLoss: -206.25,
    gainLossPercent: -15.87,
    sector: "Consumer Cyclical"
  },
  {
    ticker: "VOO",
    name: "Vanguard S&P 500 ETF",
    shares: 8,
    currentPrice: 455.3,
    totalValue: 3642.4,
    gainLoss: 521.6,
    gainLossPercent: 16.72,
    sector: "Funds"
  },
  {
    ticker: "NVDA",
    name: "NVIDIA Corp",
    shares: 4,
    currentPrice: 612.4,
    totalValue: 2449.6,
    gainLoss: 529.6,
    gainLossPercent: 27.58,
    sector: "Technology"
  }
            Respond to this prompt from a user, keep in mind you are not a financial advisor: ''' + f'{msg}'
        )
        return {"response": f"{interaction.output_text}"}, 200

    # -------------------------


    # Return the configured Flask system
    return app