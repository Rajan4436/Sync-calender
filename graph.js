// Create an authentication provider
const authProvider = {
  getAccessToken: async () => {
    // Call getToken in auth.js
    return await getToken();
  }
};

// Initialize the Graph client
const graphClient = MicrosoftGraph.Client.initWithMiddleware({authProvider});


async function getUser() {
  return await graphClient
    .api('/me')
    // Only get the fields used by the app
    .select('id,displayName,mail,userPrincipalName,mailboxSettings')
    .get();
}

async function getEvents() {
  const user = JSON.parse(sessionStorage.getItem('graphUser'));

  // Convert user's Windows time zone ("Pacific Standard Time")
  // to IANA format ("America/Los_Angeles")
  // Moment needs IANA format
  let ianaTimeZone = getIanaFromWindows(user.mailboxSettings.timeZone);
  console.log(`Converted: ${ianaTimeZone}`);

  // Configure a calendar view for the current week
  // Get midnight on the start of the current week in the user's timezone,
  // but in UTC. For example, for Pacific Standard Time, the time value would be
  // 07:00:00Z
  let startOfWeek = moment.tz('America/Los_Angeles').startOf('week').utc();
  // Set end of the view to 7 days after start of week
  let endOfWeek = moment(startOfWeek).add(7, 'day');

  try {
    // GET /me/calendarview?startDateTime=''&endDateTime=''
    // &$select=subject,organizer,start,end
    // &$orderby=start/dateTime
    // &$top=50
    let response = await graphClient
      .api('/me/calendarview')
      // Set the Prefer=outlook.timezone header so date/times are in
      // user's preferred time zone
      .header("Prefer", `outlook.timezone="${user.mailboxSettings.timeZone}"`)
      // Add the startDateTime and endDateTime query parameters
      .query({ startDateTime: startOfWeek.format(), endDateTime: endOfWeek.format() })
      // Select just the fields we are interested in
      .select('subject,organizer,start,end')
      // Sort the results by start, earliest first
      .orderby('start/dateTime')
      // Maximum 50 events in response
      .top(50)
      .get();

    times = []
    
    for (var i = response.value.length - 1; i >= 0; i--) {
      times.push({
        title: response.value[i].subject,
        start: response.value[i].start.dateTime,
        end: response.value[i].end.dateTime,
      })
    }

    schedule = { 
      email: user.userPrincipalName,
      type: "ms",
      events: times
    }

    schedules = JSON.parse(localStorage.getItem("schedules")) || []

    schedules = deleteByValue(user.userPrincipalName, schedules)
    schedules.push(schedule)
    localStorage.setItem("schedules", JSON.stringify(schedules))
    
    console.log(schedules)
    // reload()
    // updatePage(Views.calendar, response.value);
  } catch (error) {
    console.log(error)
    updatePage(Views.error, {
      message: 'Error getting events',
      debug: error
    });
  }
}

function deleteByValue(val, arr) {
  var key = null;
  for (var k in arr){
    if ((arr[k].email === val) && (arr[k].type == "ms")) {
      key = k;
      break;
    }
  }
  console.log(key)
  if (key != null){
    delete arr[key];
  }

  var filtered = arr.filter(function (el) {
    return el != null;
  });

  return filtered
}


async function createNewEvent() {
  const user = JSON.parse(sessionStorage.getItem('graphUser'));

  // Get the user's input
  const subject = document.getElementById('ev-subject').value;
  const attendees = document.getElementById('ev-attendees').value;
  const start = document.getElementById('ev-start').value;
  const end = document.getElementById('ev-end').value;
  const body = document.getElementById('ev-body').value;

  // Require at least subject, start, and end
  if (!subject || !start || !end) {
    updatePage(Views.error, {
      message: 'Please provide a subject, start, and end.'
    });
    return;
  }

  // Build the JSON payload of the event
  let newEvent = {
    subject: subject,
    start: {
      dateTime: start,
      timeZone: user.mailboxSettings.timeZone
    },
    end: {
      dateTime: end,
      timeZone: user.mailboxSettings.timeZone
    }
  };

  if (attendees)
  {
    const attendeeArray = attendees.split(';');
    newEvent.attendees = [];

    for (const attendee of attendeeArray) {
      if (attendee.length > 0) {
        newEvent.attendees.push({
          type: 'required',
          emailAddress: {
            address: attendee
          }
        });
      }
    }
  }

  if (body)
  {
    newEvent.body = {
      contentType: 'text',
      content: body
    };
  }

  try {
    // POST the JSON to the /me/events endpoint
    await graphClient
      .api('/me/events')
      .post(newEvent);

    // Return to the calendar view
    getEvents();
  } catch (error) {
    updatePage(Views.error, {
      message: 'Error creating event',
      debug: error
    });
  }
}