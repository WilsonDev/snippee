const { Menu } = require('electron');
const { sendCommand } = require('./utils');

const generateMenu = (window) => {
	const template = [
		{
			label: 'App',
			submenu: [{ role: 'about' }, { role: 'quit' }],
		},
		{
			label: 'File',
			submenu: [
				{
					label: 'New',
					accelerator: 'CommandOrControl+N',
					click: () => sendCommand(window, { action: 'ADD_SNIPPET' })
				},
				{ role: 'undo' },
				{ role: 'redo' },
				{ type: 'separator' },
				{ role: 'cut' },
				{ role: 'copy' },
				{ role: 'paste' },
				{ role: 'delete' },
				{ role: 'selectall' },
			]
		},
		{
			role: 'window',
			submenu: [{ role: 'minimize' }, { role: 'close' }],
		}
	];

	Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

module.exports = { generateMenu };
