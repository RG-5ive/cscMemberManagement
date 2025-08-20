import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PlusCircle, Trash2 } from "lucide-react";

type QuestionType = "text" | "multipleChoice" | "singleChoice";

interface Question {
  type: QuestionType;
  text: string;
  options?: string[];
}

interface SurveyFormData {
  title: string;
  questions: Question[];
}

export function SurveyForm() {
  const { toast } = useToast();
  const form = useForm<SurveyFormData>({
    defaultValues: {
      title: "",
      questions: [{ type: "text", text: "" }],
    },
  });

  async function onSubmit(data: SurveyFormData) {
    try {
      await apiRequest("POST", "/api/surveys", data);
      queryClient.invalidateQueries({ queryKey: ["/api/surveys"] });
      toast({
        title: "Survey Created",
        description: "The survey has been created successfully.",
      });
      form.reset();
    } catch (error) {
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  }

  const addQuestion = () => {
    const questions = form.getValues("questions");
    form.setValue("questions", [...questions, { type: "text", text: "" }]);
  };

  const removeQuestion = (index: number) => {
    const questions = form.getValues("questions");
    form.setValue(
      "questions",
      questions.filter((_, i) => i !== index)
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Survey Title</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Enter survey title" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.watch("questions").map((question, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="flex justify-between items-start mb-4">
                <FormField
                  control={form.control}
                  name={`questions.${index}.type`}
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Question Type</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex space-x-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="text" id={`text-${index}`} />
                            <Label htmlFor={`text-${index}`}>Text</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem
                              value="singleChoice"
                              id={`single-${index}`}
                            />
                            <Label htmlFor={`single-${index}`}>Single Choice</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem
                              value="multipleChoice"
                              id={`multiple-${index}`}
                            />
                            <Label htmlFor={`multiple-${index}`}>
                              Multiple Choice
                            </Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeQuestion(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <FormField
                control={form.control}
                name={`questions.${index}.text`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Question Text</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Enter your question" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {(question.type === "singleChoice" ||
                question.type === "multipleChoice") && (
                <FormField
                  control={form.control}
                  name={`questions.${index}.options`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Options (one per line)</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value?.join("\n") || ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                .split("\n")
                                .filter((option) => option.trim())
                            )
                          }
                          placeholder="Enter options"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>
        ))}

        <Button type="button" variant="outline" onClick={addQuestion}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Question
        </Button>

        <Button type="submit" className="w-full">
          Create Survey
        </Button>
      </form>
    </Form>
  );
}
