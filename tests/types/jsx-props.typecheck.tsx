/**
 * Typecheck-only guard (QA-01). Without React's type declarations, JSX accepts
 * any props and `tsc` silently stops checking components. Each line below must
 * be a type error; if one stops erroring, its @ts-expect-error fails `tsc`.
 */
import Loader from '../../components/Loader';

// @ts-expect-error -- `text` is a required prop
export const missingRequiredProp = <Loader />;

// @ts-expect-error -- `notAProp` is not a Loader prop
export const unknownProp = <Loader text="Loading" notAProp />;
