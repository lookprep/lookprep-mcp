/**
 * The hosted server's instructions, answered locally in `initialize` so the
 * client's handshake never waits for the network. LookPrep's source
 * repository tests that this text equals what the hosted server sends; a
 * change there needs a release of this package.
 */
export const INSTRUCTIONS =
  "LookPrep shows simulated previews of lip filler looks and a lip flip for adults (18+) planning a consultation. " +
  "These tools only read the public look catalogue, prices and stored demo images, and give a link into the web flow. " +
  "A personal preview needs the person to open the link, accept the photo terms and upload their own photo on lookprep.com; it cannot be done here. " +
  "Payment happens only on LookPrep's Stripe Checkout page, never through these tools. Link is enabled there, so an agent whose owner has a Link wallet for agents (Stripe offers it to buyers in the United States and Canada) can pay on that page after the owner approves; everyone else pays on the page themselves. " +
  "Describe every image as a simulation, not a prediction of a result, and not medical advice.";
