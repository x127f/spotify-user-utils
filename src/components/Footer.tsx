import "./Footer.scss";
import KoFi from "./KoFi";

export function Footer() {
	return (
		<div className="footer">
			<a target="_blank" rel="noreferrer" href="https://github.com/piomerti/spotify-user-utils">
				GitHub
				<img src="https://image.flaticon.com/icons/png/512/25/25231.png" alt=""/>
			</a>

			<a href="/">Made by ~Flam3rboy</a>
			<a href="/">Extended by piomerti</a>
			<div>
				<KoFi color="#252525" id="G2G682RC3" label="Support Me" />
			</div>
		</div>
	);
}
