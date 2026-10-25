/** Retain the original creation payload while the server outcome is uncertain. */
export class CreationAttempt {
 private body: Record<string, unknown> | null = null;
 prepare(body: Record<string, unknown>) {
  this.body ??= structuredClone(body);
  return structuredClone(this.body);
 }
 clear() { this.body = null; }
}

/** A late save must not restore an exited session or advance a different one. */
export function completeReview<T extends {index:number}>(active:T|null,submitted:T,conflict=false):T|null {
 return active === submitted ? (conflict ? null : {...active,index:active.index+1}) : active;
}
