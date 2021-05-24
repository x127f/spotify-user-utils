import React from "react";
import ReactDOM from "react-dom";
import { Switch, Route, BrowserRouter, Redirect } from "react-router-dom";
import "./index.scss";
import LandingPage from "./pages/Landing";
import AuthenticatePage from "./pages/Authenticate";
import OverviewPage from "./pages/Overview";
import { useAuth } from "./util/spotify";
import { Footer } from "./components/Footer";

function App() {
	return (
		<>
			<Route exact path="/" component={LandingPage}></Route>
			<Route exact path="/authenticate" component={AuthenticatePage}></Route>
			<PrivateRoute exact path="/overview">
				<OverviewPage></OverviewPage>
			</PrivateRoute>
		</>
	);
}

function PrivateRoute({ children, ...rest }: any) {
	const access_token = useAuth();

	return (
		<Route
			{...rest}
			render={({ location }) =>
				access_token ? (
					children
				) : (
					<Redirect
						to={{
							pathname: "/",
							state: { from: location },
						}}
					/>
				)
			}
		/>
	);
}

ReactDOM.render(
	<React.StrictMode>
		<BrowserRouter>
			<Switch>
				<App></App>
			</Switch>
		</BrowserRouter>
		<Footer />
	</React.StrictMode>,
	document.getElementById("root")
);
