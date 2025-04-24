const flags = 2172911616;

const hasRequireAuth = (flags & 0x00040000) !== 0;
const hasDefaultRipple = (flags & 0x00800000) !== 0;
const hasDepositAuth = (flags & 0x01000000) !== 0;
const hasAllowTrustLineClawback = (flags & 	0x80000000) !== 0;

console.log({
  hasRequireAuth,
  hasDefaultRipple,
  hasDepositAuth,
  hasAllowTrustLineClawback
});
