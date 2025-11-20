import { NextResponse } from "next/server";
import Entry from "@/models/Entry";
import { connectDB } from "@/lib/mongodb";

export async function GET() {
  await connectDB();
  const data = await Entry.find({}).sort({ createdAt: -1 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  await connectDB();
  const body = await request.json();
  const { name, type, count } = body;
  const numericCount = typeof count === "string" ? Number(count) : count;

  if (!name || !type || numericCount === undefined || numericCount === null || Number.isNaN(Number(numericCount))) {
    return NextResponse.json({ message: "Name, type and count required" }, { status: 400 });
  }

  const newEntry = await Entry.create({ name, type, count: Number(numericCount), completed: false });
  
  return NextResponse.json(newEntry);
}

export async function PUT(request: Request) {
  await connectDB();
  const body = await request.json();
  const { id, name, type, completed, count } = body;
  if (!id) {
    return NextResponse.json({ message: "ID is required" }, { status: 400 });
  }

  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (type !== undefined) updateData.type = type;
  if (completed !== undefined) updateData.completed = completed;
  if (count !== undefined) updateData.count = Number(count);

  const updated = await Entry.findByIdAndUpdate(id, updateData, { new: true });
  return NextResponse.json(updated);
}

export async function DELETE(request: Request) {
  await connectDB();
  const body = await request.json();
  await Entry.findByIdAndDelete(body.id);
  return NextResponse.json({ success: true });
}
