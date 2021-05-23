import "./App.scss";

function App() {
	return (
		<div className="album">
			<div className="album__info">
				<div className="album__info__art">
					<img
						src="https://s3-us-west-2.amazonaws.com/s.cdpn.io/7022/whenDarkOut.jpg"
						alt="When It's Dark Out"
					/>
				</div>

				<div className="album__info__meta">
					<div className="album__year">2021</div>

					<div className="album__name">Title</div>

					<div className="album__actions">
						<button className="button-light save">Save</button>
					</div>
				</div>
			</div>

			<div className="album__tracks">
				<div className="tracks">
					<div className="tracks__heading">
						<div className="tracks__heading__number">#</div>

						<div className="tracks__heading__title">Song</div>

						<div className="tracks__heading__length">Length</div>
					</div>

					<div className="track">
						<div className="track__number">1</div>

						<div className="track__added">
							<i className="ion-checkmark-round added"></i>
						</div>

						<div className="track__title">Intro</div>

						<div className="track__length">1:11</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default App;
