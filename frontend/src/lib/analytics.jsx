import React from 'react';

/* PostHog (EU cloud), loaded via the official browser snippet at runtime so there is no
   build-time import to bundle (works in any host, including this preview). Runs once on the
   client; SSR-guarded. Any capture() calls made through track() before the SDK finishes
   downloading are queued by the stub and replayed automatically once it loads. */
if (typeof window !== 'undefined' && !window.__clipperPHInit) {
  window.__clipperPHInit = true;
  /* Hardened: the official snippet assumes an existing <script> tag to insert
     before; if the host page has none (module preload, exotic embeds, tests),
     that would throw at module scope and take the whole app down with it.
     Analytics must never be able to do that, so the bootstrap is fully fenced. */
  try {
    // eslint-disable-next-line no-cond-assign -- vendored PostHog loader snippet (minified)
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0])?r.parentNode.insertBefore(p,r):(t.head||t.documentElement).appendChild(p);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageViewId captureTraceFeedback captureTraceMetric".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    window.posthog.init('phc_ttc6fGPaBCLNYQfsRNTCeAZZt9oojcnfYrA52XtBmSN6', {
      api_host: 'https://eu.i.posthog.com',
      defaults: '2026-05-30',
    });
  } catch (e) { /* analytics must never break the site */ }
}

/* Phase 1 analytics. Captures REAL events through PostHog when its snippet is
   loaded on the page (window.posthog). Safe no-op until then. Never fabricates data. */
const track = (event, props) => {
  try {
    if (typeof window !== 'undefined' && window.posthog && typeof window.posthog.capture === 'function') {
      window.posthog.capture(event, props || {});
    }
  } catch (e) { /* analytics must never break the UI */ }
};

export { track };
