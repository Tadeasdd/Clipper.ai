import React from 'react';
import { LegalSection, PageHero } from '../components/site-chrome.jsx';

function PrivacyPage({ goto }) {
  return (
    <>
      <PageHero eyebrow="Legal" title="Privacy," italic="in plain English." sub="What we collect today, what we do with it, and how to make us delete it. Last updated June 2026." />
      <section className="relative z-10 max-w-3xl mx-auto px-6 md:px-8 pb-16">
        <LegalSection title="What we collect">
          <p>Right now this site collects one thing: the email address (and optional content type) you submit when you request a strategy call. We also use privacy-respecting product analytics to understand how visitors use the site.</p>
        </LegalSection>
        <LegalSection title="What we do with it">
          <p>We use your email to schedule your call and to follow up about working together. We do not sell it, rent it, or share it with advertisers.</p>
        </LegalSection>
        <LegalSection title="Your recordings and your IP">
          <p>When you become a client, your recordings stay yours. We never train models on your content, and we delete source material on request.</p>
        </LegalSection>
        <LegalSection title="Deletion and questions">
          <p>Email privacy@clipper.ai and we will remove your data, usually within a few days. Questions about anything here are welcome at the same address.</p>
        </LegalSection>
      </section>
    </>
  );
}

function TermsPage({ goto }) {
  return (
    <>
      <PageHero eyebrow="Legal" title="Terms," italic="the short version." sub="Clipper.ai is in early access. These are the honest ground rules until full terms ship with the service agreement. Last updated June 2026." />
      <section className="relative z-10 max-w-3xl mx-auto px-6 md:px-8 pb-16">
        <LegalSection title="The site">
          <p>The sample run, scores, and numbers shown on this site are demonstrations on sample footage, not results we promise you. We cannot guarantee any clip goes viral; nobody honestly can.</p>
        </LegalSection>
        <LegalSection title="The service">
          <p>Client work is governed by the service agreement you sign at onboarding, which covers scope, pricing, ownership, and turnaround. Your content remains your property throughout.</p>
        </LegalSection>
        <LegalSection title="Contact">
          <p>Anything unclear, email hello@clipper.ai before you book. We would rather answer questions up front.</p>
        </LegalSection>
      </section>
    </>
  );
}

export { PrivacyPage, TermsPage };
