import { Injectable } from '@nestjs/common';
import { ReposService } from '../../repos/repos.service';
import type { GetUsageResponseDto } from '../dto/get-usage.dto';
import { periodStart } from '../reviews.period';
import { ReviewsRepository, type UsageTotals } from '../reviews.repository';

export const HEATMAP_DAYS = 365;
const NONE: UsageTotals = { reviews: 0, inputTokens: 0, outputTokens: 0 };

// "2026-10-24" for the calendar day of `date` on this machine.
const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const totalsOf = ({ reviews, inputTokens, outputTokens }: UsageTotals): UsageTotals => ({ reviews, inputTokens, outputTokens });

// Each group listed once, with its all-time and its this-month totals side by side, biggest token user first.
function merge<T extends UsageTotals>(allTime: T[], month: T[], key: (row: T) => string) {
  const monthByKey = new Map(month.map((row) => [key(row), row]));
  return allTime
    .map((row) => ({ row, month: totalsOf(monthByKey.get(key(row)) ?? NONE) }))
    .sort((a, b) => b.row.inputTokens + b.row.outputTokens - (a.row.inputTokens + a.row.outputTokens) || b.row.reviews - a.row.reviews);
}

@Injectable()
export class GetUsageUsecase {
  constructor(
    private readonly reviewsRepository: ReviewsRepository,
    private readonly reposService: ReposService,
  ) {}

  async execute(now: Date = new Date()): Promise<GetUsageResponseDto> {
    const monthStart = periodStart('month', now);
    // The first day shown: 364 days before today, so today is the 365th.
    const firstDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (HEATMAP_DAYS - 1));

    const [allTime, month, modelsAll, modelsMonth, reposAll, reposMonth, created] = await Promise.all([
      this.reviewsRepository.usageTotals(),
      this.reviewsRepository.usageTotals(monthStart),
      this.reviewsRepository.usageByModel(),
      this.reviewsRepository.usageByModel(monthStart),
      this.reviewsRepository.usageByRepo(),
      this.reviewsRepository.usageByRepo(monthStart),
      this.reviewsRepository.findCreatedAtSince(firstDay),
    ]);
    const names = await this.reposService.getFullNames(reposAll.map((row) => row.repositoryId));

    const modelRows = (rows: typeof modelsAll) => rows.map((row) => ({ ...row, provider: row.provider ?? 'unknown' }));
    const byModel = merge(modelRows(modelsAll), modelRows(modelsMonth), (row) => `${row.provider}/${row.model}`).map(({ row, month }) => ({
      provider: row.provider,
      model: row.model,
      allTime: totalsOf(row),
      month,
    }));
    const byRepo = merge(
      reposAll.map((row) => ({ ...row, repoFullName: names.get(row.repositoryId) ?? row.repositoryId })),
      reposMonth.map((row) => ({ ...row, repoFullName: names.get(row.repositoryId) ?? row.repositoryId })),
      (row) => row.repositoryId,
    ).map(({ row, month }) => ({
      repositoryId: row.repositoryId,
      repoFullName: row.repoFullName,
      allTime: totalsOf(row),
      month,
    }));

    const perDay = new Map<string, number>();
    for (const at of created) perDay.set(dayKey(at), (perDay.get(dayKey(at)) ?? 0) + 1);
    const days = Array.from({ length: HEATMAP_DAYS }, (_, i) => {
      const date = dayKey(new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() + i));
      return { date, count: perDay.get(date) ?? 0 };
    });

    return { allTime, month, byModel, byRepo, days };
  }
}
