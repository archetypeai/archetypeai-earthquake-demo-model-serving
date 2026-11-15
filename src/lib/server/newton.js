import { ATAI_API_KEY, ATAI_API_ENDPOINT } from '$env/static/private';

// Newton C 2.6 on the Inference API.
const MODEL = 'newton-c-2.6';

function apiUrl(path) {
	const root = ATAI_API_ENDPOINT.replace(/\/$/, '').replace(/\/api$/, '');
	return `${root}/api${path}`;
}

// The Inference API stops a query after about 58 seconds and generates more
// slowly than Direct Query did, so answers are kept short: the last sentence of
// the prompt asks for under 300 words, and MAX_NEW_TOKENS caps the rest.
const INSTRUCTION_PROMPT =
	'You are a seismology AI assistant analyzing real-time USGS earthquake data. ' +
	'You help users understand current seismic activity patterns, identify aftershock sequences, ' +
	'regional clustering, and assess whether activity levels are normal or elevated. ' +
	'Be precise with magnitudes and locations. When analyzing patterns, consider: ' +
	'spatial clustering (earthquakes near each other may be related), temporal patterns ' +
	'(aftershock sequences follow large events), and depth variations. ' +
	'Magnitude scale context: M<2 (micro, not felt), M2-4 (minor/light), M4-5 (moderate, felt widely), ' +
	'M5-6 (strong, potential damage), M6-7 (major), M7+ (great, significant damage). ' +
	'Keep each answer under 300 words: lead with the direct answer, then the few facts from the data ' +
	'that support it, using short bullet lists.';

const MAX_NEW_TOKENS = 1536;
// Listing magnitudes, the model can fall into a loop ("M1.8, M1.9, M1.8, ...")
// until it runs out of tokens or time. A mild repetition penalty breaks it.
// /inference/query applies it; Chat Completions ignores it.
const REPETITION_PENALTY = 1.1;

export async function queryNewton(query) {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 90000);

	try {
		const res = await fetch(apiUrl('/inference/query'), {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${ATAI_API_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				model: MODEL,
				query,
				system_prompt: INSTRUCTION_PROMPT,
				max_new_tokens: MAX_NEW_TOKENS,
				repetition_penalty: REPETITION_PENALTY
			}),
			signal: controller.signal
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(`POST /api/inference/query failed: ${res.status} - ${JSON.stringify(err)}`);
		}

		const data = await res.json();
		const inner = data?.response;
		if (inner?.success === false) throw new Error(`Model returned success=false: ${JSON.stringify(inner)}`);
		const text = Array.isArray(inner?.response) ? inner.response[0] : inner?.response;
		if (typeof text !== 'string' || !text.trim()) throw new Error(`Unexpected response: ${JSON.stringify(data)}`);
		return text.trim();
	} finally {
		clearTimeout(timeoutId);
	}
}
