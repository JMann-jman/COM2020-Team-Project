from flask import Flask, render_template, request

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/explore")
def explore():
    return render_template("explore.html")

@app.route("/report", methods=["GET", "POST"])
def report():
    # For Sprint 1 UI demo, just render page.
    # Later: handle POST (request.form) in backend.
    return render_template("report.html")

@app.route("/moderate")
def moderate():
    return render_template("moderate.html")

@app.route("/hotspots")
def hotspots():
    return render_template("hotspots.html")

@app.route("/plan", methods=["GET", "POST"])
def plan():
    return render_template("plan.html")

@app.route("/quest")
def quest():
    return render_template("quest.html")

if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)