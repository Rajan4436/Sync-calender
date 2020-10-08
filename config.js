const msalConfig = {
  auth: {
    clientId: '4aaef826-944d-41a0-8bfc-8ecf8df894fc',
    redirectUri: 'http://localhost:8000'
  }
};

const msalRequest = {
  scopes: [
    'user.read',
    'mailboxsettings.read',
    'calendars.readwrite'
  ]
}