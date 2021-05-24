import { ReactNode, useEffect, useRef, useState } from "react";
import "./Popup.scss";

export function Popup({ open, children, setOpen }: { open: boolean; children: ReactNode; setOpen: any }) {
	const ref = useRef(null);

	useEffect(() => {
		function eventhandler(event: Event) {
			// @ts-ignore
			if (ref.current && !ref?.current?.contains(event.target)) {
				setOpen(false);
			}
		}

		document.addEventListener("mousedown", eventhandler);

		return () => {
			document.removeEventListener("mousedown", eventhandler);
		};
	}, []);

	return (
		<div ref={ref} className={`popup ${open && "open"}`}>
			{children}
		</div>
	);
}
