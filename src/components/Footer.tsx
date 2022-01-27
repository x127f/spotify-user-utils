import "./Footer.scss";
import KoFi from "./KoFi";

export function Footer() {
	return (
		<div className="footer">
			<ul>
				<li>
				<a target="_blank" rel="noreferrer" href="https://github.com/piomerti/spotify-user-utils">
				GitHub
				{/*<img src="https://image.flaticon.com/icons/png/512/25/25231.png" alt=""/>*/}
			</a></li>

				<li><a href="/">Made by ~Flam3rboy</a></li>
				<li><a href="/">Extended by piomerti</a></li>
				<li><KoFi color="#252525" id="G2G682RC3" label="Support Me" /></li>
			</ul>
		</div>
	);
}
