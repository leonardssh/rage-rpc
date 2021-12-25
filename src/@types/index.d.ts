// eslint-disable-next-line no-var
declare var mp: any;

declare interface Browser {
	url: string;
	execute: (code: string) => void;
	[property: string]: any;
}

declare interface Player {
	call: (eventName: string, args?: any[]) => void;
	[property: string]: any;
}
