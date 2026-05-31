import ClipperApp from '@/components/ClipperApp';

// The marketing page + studio demo are the same component — it switches from
// the landing view to the app view on the CTA, which is exactly the flow we
// want: founders read the positioning, then click into the live demo.
export default function Page() {
  return <ClipperApp />;
}
