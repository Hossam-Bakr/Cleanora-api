export function assertDocumentMetadataDates(input: {
  readonly issueDate: Date;
  readonly expiresAt: Date | null;
  readonly now: Date;
}): void {
  if (
    Number.isNaN(input.issueDate.getTime()) ||
    Number.isNaN(input.now.getTime()) ||
    input.issueDate.getTime() > input.now.getTime() ||
    (input.expiresAt !== null && (
      Number.isNaN(input.expiresAt.getTime()) ||
      input.expiresAt.getTime() <= input.issueDate.getTime()
    ))
  ) throw new Error("DOCUMENT_METADATA_INVALID");
}
