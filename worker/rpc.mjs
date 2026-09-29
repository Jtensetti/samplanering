export async function call(stub, method, ...args) {
  const result = await stub.invoke(method, args);
  if (!result.ok)
    throw Object.assign(new Error(result.error), { status: result.status });
  return result.data;
}
export async function reply(operation) {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    const status = Number(error.status) || 500;
    if (status >= 500)
      console.error(
        JSON.stringify({ event: "workspace_error", message: error.message }),
      );
    return {
      ok: false,
      status,
      error: status >= 500 ? "Något gick fel. Försök igen." : error.message,
    };
  }
}
