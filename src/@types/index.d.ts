// eslint-disable-next-line no-var
declare var mp: any;

declare interface BrowserMp {
	url: string;
	execute: (code: string) => void;
	[property: string]: any;
}

declare interface PlayerMp {
	call: (eventName: string, args?: any[]) => void;
	[property: string]: any;
}
