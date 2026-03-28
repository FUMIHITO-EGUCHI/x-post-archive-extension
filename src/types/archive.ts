export type PostRecord = {
  x_post_id: string;
  x_username: string;
  post_text: string;
  post_url: string;
  saved_at: number;
};

export type SavePostInput = Omit<PostRecord, "saved_at">;
