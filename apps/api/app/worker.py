import asyncio
import logging

from app.services.jobs import claim_next_job, mark_job_failed, process_job

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)


async def main() -> None:
    logger.info("Worker iniciado.")
    while True:
        job = await claim_next_job()
        if job:
            logger.info("Job %s (%s) iniciado.", job["id"], job["type"])
            try:
                await process_job(job)
                logger.info("Job %s concluído.", job["id"])
            except Exception as exc:
                logger.error("Job %s falhou: %s", job["id"], exc)
                await mark_job_failed(str(job["id"]), str(exc))
        else:
            await asyncio.sleep(2)


if __name__ == "__main__":
    asyncio.run(main())
