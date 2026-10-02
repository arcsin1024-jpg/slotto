/** つなぎ目のスタブが投げるエラー。担当セッションが実装したら使われなくなる */
export class NotImplementedError extends Error {
  constructor(name: string, owner: string) {
    super(`${name} はまだ実装されていません(担当: ${owner})`);
    this.name = "NotImplementedError";
  }
}
