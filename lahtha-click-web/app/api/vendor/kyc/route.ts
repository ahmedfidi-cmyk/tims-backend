interface KycSubmission {
  step: number
  data: Record<string, any>
}

const submissions: KycSubmission[] = []

export async function POST(req: Request) {
  const body = await req.json()
  submissions.push(body)
  return Response.json({
    success: true,
    step: body.step,
    next_step: body.step < 4 ? body.step + 1 : null,
  })
}

export async function GET() {
  return Response.json({ submissions, total: submissions.length })
}
