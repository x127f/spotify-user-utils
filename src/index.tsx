import React from "react";
import ReactDOM from "react-dom";
import { Routes, Route, BrowserRouter, Navigate, useLocation } from "react-router-dom";
import "./index.scss";
import LandingPage from "./pages/Landing";
import AuthenticatePage from "./pages/Authenticate";
import OverviewPage from "./pages/Overview";
import { useAuth } from "./util/spotify";
import { Footer } from "./components/Footer";

/*
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
*/

function App() {
	return (
		<Routes>
			<Route path="/" element={<LandingPage/>}/>
			<Route path="/authenticate" element={<AuthenticatePage/>}/>
			<Route path="/overview" element={<PrivateRoute><OverviewPage /></PrivateRoute>}/>
		</Routes>
	);
}

/*
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
*/

function PrivateRoute({ children }: { children: JSX.Element }) {
	const access_token = useAuth();
	let location = useLocation();
	return access_token ? children : <Navigate to="/" state={{ from: location }} />;
}

ReactDOM.render(
	<React.StrictMode>
		<BrowserRouter>
				<App/>
		</BrowserRouter>
		<Footer />
	</React.StrictMode>,
	document.getElementById("root")
);
