import collection from "@/docs/ErvisioTodo.postman_collection.json";
export async function GET() {
  return Response.json(collection, {
    headers: {
      "Content-Disposition":
        'attachment; filename="ErvisioTodo.postman_collection.json"',
    },
  });
}
