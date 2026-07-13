import Form from "next/form";

import { signOutAction } from "./sign-out-action";

export const SignOutForm = () => {
  return (
    <Form action={signOutAction} className="w-full">
      <button
        className="w-full px-1 py-0.5 text-left text-destructive"
        type="submit"
      >
        Sign out
      </button>
    </Form>
  );
};
