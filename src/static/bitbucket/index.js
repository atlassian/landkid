require('unfetch/polyfill');
const queryString = require('qs');

const endpoint = window.location.origin;

const landButtonView = () => {
  return `<div>
    <p>This PR is not queued for Landing yet, click "Land" below or <a href="/index.html" target="_blank">here</a> for more information</p>
    <br>
    <button type="button" class="ak-button ak-button__appearance-primary" onClick="wantToMergeClicked()">
      Land!
      </button>
  </div>`;
};

const isQueuedView = () => {
  return `<div>
    <p>This PR is queued for release now. See <a href="/current-state/index.html" target="_blank">here</a> to see the current queue</p>
    <p>
      <button type="button" class="ak-button ak-button__appearance-default" onClick="cancelButtonClicked()">
        Cancel release
      </button>
    </p>
  </div>`;
};

const cancellingView = () => {
  return `<div>
    <p>Cancelling...</p>
  </div>`;
};

const checkingPullRequestView = () => {
  return `<div>
    <p>Checking pull request...</p>
  </div>`;
};

const pausedView = pausedReason => {
  return `<div>
    <p>Land builds are currently paused:</p>
    <p id="pausedReason"></p>
    <p>Please try again later.</p>
  </div>`;
};

const notAllowedToLand = reasons => {
  const isOpen = reasons.isOpen;
  const isApproved = reasons.isApproved;
  const isGreen = reasons.isGreen;

  if (!isOpen) {
    return `<div><p>PR is already closed!</p></div>`;
  }
  if (!isApproved) {
    return `<div><p>Pull request needs to be approved</p></div>`;
  }
  if (!isGreen) {
    return `<div><p>Pull Request needs a green build</p></div>`;
  }
  console.log(reasons);
  return `<div>
    <p>Error finding reason, please check console</p>
  </div>`;
};

const errorCreatingLandRequestView = err => {
  console.error(err);
  const reason = err.reason || "We honestly don't know... See error console";
  return `<div>
    <p>There was an error whilst queueing your land request:</p>
    <p style="color: red">${reason}</p>
  </div>`;
};

function getCurrentState() {
  return fetch(`${endpoint}/api/current-state`)
    .then(resp => resp.json())
    .catch(err => console.error('error ', err));
}

// Fetches the user, repo and id vars
function getQueryStringVars() {
  const qs = window.location.search.substring(1);
  return queryString.parse(qs);
}

function wantToMergeClicked1() {
  setView(checkingPullRequestView());

  const qs = getQueryStringVars();
  fetch(`${endpoint}/api/is-allowed-to-land/${qs.pullRequestId}`)
    .then(resp => resp.json())
    .then(data => {
      if (data.isAllowedToLand.isAllowed) {
        return landPullRequest();
      } else {
        setView(notAllowedToLand(data.isAllowedToLand));
      }
    })
    .catch(err => {
      setView(errorCreatingLandRequestView(err));
    });
}

function landPullRequest() {
  const qs = getQueryStringVars();

  const qsString = queryString.stringify({
    username: qs.username,
    userUuid: qs.userUuid,
    commit: qs.commit,
    title: qs.title
  });

  return fetch(`${endpoint}/api/land-pr/${qs.pullRequestId}?${qsString}`, {
    method: 'POST'
  })
    .then(resp => resp.json())
    .then(() => setView(isQueuedView()))
    .catch(err => {
      setView(errorCreatingLandRequestView(err));
    });
}

function cancelButtonClicked() {
  setView(cancellingView());

  const qs = getQueryStringVars();
  const qsString = queryString.stringify({
    username: qs.username,
    userUuid: qs.userUuid
  });

  return fetch(`${endpoint}/api/cancel-pr/${qs.pullRequestId}?${qsString}`, {
    method: 'POST'
  })
    .then(resp => resp.json())
    .then(() => setView(landButtonView()))
    .catch(err => {
      setView(errorCreatingLandRequestView(err));
    });
}

function displayQueueOrLandButton(queue, running) {
  const queryStringVars = getQueryStringVars();
  const pullRequestId = queryStringVars.pullRequestId;
  const isQueuedOrRunning =
    queue.some(pr => pr.pullRequestId === pullRequestId) ||
    running.pullRequestId === pullRequestId;

  console.log('Current queue: ', queue);

  if (isQueuedOrRunning) {
    setView(isQueuedView());
  } else {
    setView(landButtonView());
  }
}

const qs = getQueryStringVars();
if (qs.state === 'OPEN') {
  getCurrentState().then(stateResp => {
    const allowedToMerge = stateResp.usersAllowedToMerge;
    const paused = stateResp.paused;
    const pausedReason =
      stateResp.pausedReason || 'Builds have been paused manually';
    if (paused) {
      setView(pausedView());
      // this is a bit messy, but we don't want to render "user" generated content as DOM, so we
      // have to separately render the text content for the reason
      document.querySelector('#pausedReason').textContent = pausedReason;
    } else if (allowedToMerge.indexOf(qs.username) > -1) {
      displayQueueOrLandButton(stateResp.queue, stateResp.running);
    }
  });
} else {
  setView(
    notAllowedToLand({
      isOpen: false
    })
  );
}

// Wrapper function so that all the other HTML can all be wraped in this
function setView(innerHtml) {
  document.body.innerHTML = `<div class="releaseQueueView">
    ${innerHtml}
  </div>`;
}

// I've had to just add this hack as the functions declared here aren't available globally anymore
// I havent added the rest of the events since we're about to replace it, just FYI
window.wantToMergeClicked = wantToMergeClicked1;
